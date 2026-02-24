import { NestedStack, StackProps } from 'aws-cdk-lib';
import { ISecurityGroup, IVpc, Peer, Port } from 'aws-cdk-lib/aws-ec2';
import { CfnCacheCluster, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';


export interface RedisDBProps extends StackProps {
    readonly vpc: IVpc;
    readonly engineVersion?: string;
    readonly nodes?: number;
    readonly nodeType?: string;
    readonly existSecurityGroupIds: string[];
    readonly internalSecurityGroup: ISecurityGroup;
    readonly externalSecurityGroup: ISecurityGroup;
}

export class NestedRedisStack extends NestedStack {
    public readonly cacheCluster: CfnCacheCluster;
    public static PORT = 6379;

    constructor(scope: Construct, id: string, props: RedisDBProps) {
        super(scope, id);
        const redisSubnetGroup = new CfnSubnetGroup(this, `${ id }-redis-subnet-group`, {
            description: 'Subnet group for the redis cluster',
            subnetIds: props.vpc.privateSubnets.map((ps) => ps.subnetId),
            cacheSubnetGroupName: `${ id }-redis-subnet-group-name`,
        });

        this.cacheCluster = new CfnCacheCluster(this, `${ id }-redis-cluster`, {
            clusterName: `${ id }-redis-cluster`,
            cacheNodeType: props.nodeType || 'cache.m6g.large',
            engine: 'redis',
            vpcSecurityGroupIds: [...props.existSecurityGroupIds],
            autoMinorVersionUpgrade: false,
            engineVersion: props.engineVersion ?? '7.0',
            cacheSubnetGroupName: redisSubnetGroup.ref,
            port: NestedRedisStack.PORT,
            numCacheNodes: props.nodes || 1,
        });

        this.cacheCluster.addDependency(redisSubnetGroup);

        props.internalSecurityGroup.connections.allowFrom(props.externalSecurityGroup, Port.tcp(NestedRedisStack.PORT));
        props.internalSecurityGroup.connections.allowTo(props.externalSecurityGroup, Port.tcp(NestedRedisStack.PORT));
        props.internalSecurityGroup.connections.allowFrom(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(NestedRedisStack.PORT));
    }
}
