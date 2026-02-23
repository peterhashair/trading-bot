import { CfnParameter, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NestedCognitoStack } from "./nested/nested-cognito-stack";
import { NestedRedisStack } from "./nested/nested-redis-stack";
import { NestedNetworkStack } from "./nested/nested-network-stack";
import { Profile } from "../bin/infra";
import { NestedRdsStack } from "./nested/nested-rds-stack";
import { ApiKeySourceType, RestApi } from "aws-cdk-lib/aws-apigateway";
import { NestedEcsStack } from "./nested/nested-ecs-stack";

export class InfraBackendStack extends Stack {
    public static DATABASE_NAME = 'tradingbot';

    constructor(scope: Construct, id: string, props?: any) {
        super(scope, id, props);

        const version = new CfnParameter(this, 'versionNumber', {
            type: 'String',
            default: 'latest',
        }).valueAsString; // get the value of the parameter as string


        const cognitoStack = new NestedCognitoStack(this, id);

        const vpcStack = new NestedNetworkStack(this, `${ id }-vpc`);

        //init redis
        const redisStack = new NestedRedisStack(this, `${ id }-redis`, {
            nodes: Profile.Prod ? 3 : 1,
            vpc: vpcStack.vpc,
            nodeType: props.profile === Profile.Prod ? 'cache.m6g.large' : 'cache.t4g.medium',
            existSecurityGroupIds: [vpcStack.internal.securityGroupId],
            internalSecurityGroup: vpcStack.internal,
            externalSecurityGroup: vpcStack.external
        });

        //init db
        const dbStack = new NestedRdsStack(this, `${ id }-rds-storage-stack`, {
            vpc: vpcStack.vpc,
            databaseName: InfraBackendStack.DATABASE_NAME,
            internalSecurityGroup: vpcStack.internal,
            externalSecurityGroup: vpcStack.external,
        });


        //setup ENV
        const environment = {
            PROFILE: props.profile,
            CDK_DEFAULT_REGION: props.env?.region ?? 'us-east-1',
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
            VERSION: version,
        };


        //todo need to update this to frontend url
        const api = new RestApi(this, `${ id }-rest-api`, {
            defaultCorsPreflightOptions: {
                allowOrigins: ['*'],
                allowHeaders: ['*'],
                allowMethods: ['*'],
            },
            apiKeySourceType: ApiKeySourceType.HEADER,
        });

        const apiV1 = api.root.addResource('v1');
        const ecsStack = new NestedEcsStack(this, `${ props.profile }-ecs-stack`, {
            profile: props.profile,
            env: environment,
            version: version,
            vpc: vpcStack.vpc,
            apiGateway: apiV1,
            auth: cognitoStack.authorizer,
            secrets: dbStack.getSecrets()
        });

        dbStack.grantRead(ecsStack.fargateService.taskDefinition.taskRole);

    }


}