import { NestedStack, NestedStackProps, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NestedCognitoStack } from "./nested/nested-cognito-stack";
import { NestedRedisStack } from "./nested/nested-redis-stack";
import { NestedNetworkStack } from "./nested/nested-network-stack";
import { Profile } from "../bin/infra";
import { NestedRdsStack } from "./nested/nested-rds-stack";
import { ApiKeySourceType, RestApi } from "aws-cdk-lib/aws-apigateway";
import { NestedEcsStack } from "./nested/nested-ecs-stack";

export interface InfraBackendStackProps extends NestedStackProps {
    profile: Profile;
    version: string;
    corsOrigin: string;
}

export class InfraBackendStack extends NestedStack {
    public static DATABASE_NAME = 'tradingbot';
    public readonly apiUrl: string;
    public readonly userPoolId: string;
    public readonly appClientId: string;

    constructor(scope: Construct, id: string, props: InfraBackendStackProps) {
        super(scope, id, props);

        const cognitoStack = new NestedCognitoStack(this, `${id}-cognito`);

        const vpcStack = new NestedNetworkStack(this, `${id}-vpc`);

        const redisStack = new NestedRedisStack(this, `${id}-redis`, {
            nodes: props.profile === Profile.Prod ? 3 : 1,
            vpc: vpcStack.vpc,
            nodeType: props.profile === Profile.Prod ? 'cache.m6g.large' : 'cache.t4g.medium',
            existSecurityGroupIds: [vpcStack.internal.securityGroupId],
            internalSecurityGroup: vpcStack.internal,
            externalSecurityGroup: vpcStack.external,
        });

        const dbStack = new NestedRdsStack(this, `${id}-rds-storage-stack`, {
            vpc: vpcStack.vpc,
            databaseName: InfraBackendStack.DATABASE_NAME,
            internalSecurityGroup: vpcStack.internal,
            externalSecurityGroup: vpcStack.external,
        });

        const environment = {
            PROFILE: props.profile,
            CDK_DEFAULT_REGION: Stack.of(this).region,
            ECS: 'enable',
            DB_HOST: dbStack.rdsCluster.clusterEndpoint.hostname,
            DB_PORT: dbStack.rdsCluster.clusterEndpoint.port.toString(),
            DB_USERNAME: 'dbadmin',
            DB_DATABASE: InfraBackendStack.DATABASE_NAME,
            DB_LOGGING: 'true',
            DB_AUTOLOAD_ENTITIES: 'true',
            DB_SCHEMA: 'true',
            REDIS_ENDPOINT: redisStack.cacheCluster.attrRedisEndpointAddress,
            REDIS_PORT: redisStack.cacheCluster.attrRedisEndpointPort,
            REDIS_TYPE: 'cluster',
            VERSION: props.version,
            COGNITO_USER_POOL_ID: cognitoStack.userPool.userPoolId,
            COGNITO_CLIENT_ID: cognitoStack.appClientId,
        };

        const api = new RestApi(this, `${id}-rest-api`, {
            defaultCorsPreflightOptions: {
                allowOrigins: [props.corsOrigin],
                allowHeaders: ['*'],
                allowMethods: ['*'],
            },
            apiKeySourceType: ApiKeySourceType.HEADER,
        });

        const apiV1 = api.root.addResource('v1');
        const ecsStack = new NestedEcsStack(this, `${props.profile}-ecs-stack`, {
            profile: props.profile,
            env: environment,
            version: props.version,
            vpc: vpcStack.vpc,
            apiGateway: apiV1,
            auth: cognitoStack.authorizer,
            secrets: dbStack.getSecrets(),
            policyStatement: cognitoStack.cognitoPolicy,
        });

        dbStack.grantRead(ecsStack.fargateService.taskDefinition.taskRole);

        this.apiUrl = api.url;
        this.userPoolId = cognitoStack.userPool.userPoolId;
        this.appClientId = cognitoStack.appClientId;
    }
}
