import { Duration, NestedStack, NestedStackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { NetworkLoadBalancedFargateService, NetworkLoadBalancedServiceRecordType } from 'aws-cdk-lib/aws-ecs-patterns';
import { IVpc, Port } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, CpuArchitecture, OperatingSystemFamily, Secret } from 'aws-cdk-lib/aws-ecs';
import {
    AuthorizationType,
    ConnectionType,
    HttpIntegration,
    IAuthorizer,
    Integration,
    IVpcLink,
    Resource,
    VpcLink,
} from 'aws-cdk-lib/aws-apigateway';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Profile } from "../../bin/infra";

export interface NestedEcsStackProps extends NestedStackProps {
    profile: Profile;
    version: string;
    env: { [key: string]: string };
    vpc: IVpc;
    secrets: ISecret;
    apiGateway: Resource;
    auth?: IAuthorizer;
}

export class NestedEcsStack extends NestedStack {
    public link: IVpcLink;
    public integration: Integration;
    public fargateService: NetworkLoadBalancedFargateService;

    constructor(scope: Construct, id: string, props: NestedEcsStackProps) {
        super(scope, id, props);

        const repository = Repository.fromRepositoryName(this, `${ props.profile }-infra-repository`, 'poe-infra-services');

        const cluster = new Cluster(this, `${ props.profile }-infra-cluster`, {
            clusterName: `${ props.profile }-infra-cluster`,
            vpc: props.vpc,
        });


        // Create a load-balanced Fargate service and make it public
        this.fargateService = new NetworkLoadBalancedFargateService(this, `${ props.profile }-infra-fargate`, {
            serviceName: `${ props.profile }-infra-fargate`,
            cluster: cluster, // Required
            desiredCount: props.profile === Profile.Prod ? 3 : 1, // Default is 1
            circuitBreaker: {
                rollback: true,
            },
            taskImageOptions: {
                image: ContainerImage.fromEcrRepository(repository, props.version),
                secrets: {
                    DB_PASSWORD: Secret.fromSecretsManager(props.secrets, 'password'),
                },
                environment: props.env,
                containerPort: 80,
                enableLogging: true,
                containerName: `${ props.profile }-infra-services`,
            },
            enableExecuteCommand: true,
            publicLoadBalancer: false, // Default is true
            assignPublicIp: false,
            listenerPort: 80,
            cpu: props.profile === Profile.Prod ? 512 : 2048,
            memoryLimitMiB: props.profile === Profile.Prod ? 2048 : 4096,
            runtimePlatform: {
                operatingSystemFamily: OperatingSystemFamily.LINUX,
                cpuArchitecture: CpuArchitecture.ARM64,
            },
            recordType: NetworkLoadBalancedServiceRecordType.ALIAS,
        });

        //allow port
        this.fargateService.service.connections.allowInternally(Port.tcp(6379));
        this.fargateService.service.connections.allowInternally(Port.tcp(5432));
        this.fargateService.service.connections.allowFromAnyIpv4(Port.tcp(80));

        //permission allow
        // props.bucket.grantReadWrite(this.fargateService.taskDefinition.taskRole);
        // props.bucket.grantDelete(this.fargateService.taskDefinition.taskRole);
        // props.userTable.grantReadWriteData(this.fargateService.taskDefinition.taskRole);
        // this.fargateService.taskDefinition.taskRole.addToPrincipalPolicy(props.policyStatement);
        // props.appointmentActionQueue.grantSendMessages(this.fargateService.taskDefinition.taskRole);

        // Setup AutoScaling
        const scaling = this.fargateService.service.autoScaleTaskCount({ maxCapacity: 2 });
        scaling.scaleOnCpuUtilization(`${ props.profile }-auto-scaling`, {
            targetUtilizationPercent: 50,
            scaleInCooldown: Duration.seconds(60),
            scaleOutCooldown: Duration.seconds(60),
        });

        this.link = new VpcLink(this, `${ props.profile }-infra-vpc-link`, {
            vpcLinkName: `${ props.profile }-infra-vpc-link`,
            targets: [this.fargateService.loadBalancer],
        });

        this.integration = new HttpIntegration(`http://${ this.fargateService.loadBalancer.loadBalancerDnsName }/{proxy}`, {
            httpMethod: 'ANY',
            options: {
                connectionType: ConnectionType.VPC_LINK,
                vpcLink: this.link,
                requestParameters: {
                    'integration.request.path.proxy': 'method.request.path.proxy',
                },
            },
        });

        props.apiGateway.addMethod('ANY');
        props.apiGateway.addProxy({
            defaultIntegration: this.integration,
            defaultMethodOptions: {
                authorizer: props.auth,
                authorizationType: AuthorizationType.COGNITO,
                requestParameters: {
                    'method.request.path.proxy': true,
                },
            },
        });
    }
}