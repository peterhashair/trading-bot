import * as cdk from 'aws-cdk-lib';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
    AuroraPostgresEngineVersion,
    ClusterInstance,
    Credentials,
    DatabaseCluster,
    DatabaseClusterEngine,
    DBClusterStorageType,
} from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface NestedRdsStackProps extends NestedStackProps {
    vpc: IVpc;
    databaseName: string;
    internalSecurityGroup: ISecurityGroup;
    externalSecurityGroup: ISecurityGroup;

}

export class NestedRdsStack extends NestedStack {
    private readonly _secret: Secret;
    public rdsCluster: DatabaseCluster;
    public static PORT = 5432;
    private readonly credentials: Credentials;

    constructor(scope: Construct, id: string, props: NestedRdsStackProps) {
        super(scope, id, props);
        const auroraPostgresVersion = AuroraPostgresEngineVersion.VER_14_6;

        // Security Group
        const databaseSecurityGroup = new SecurityGroup(this, 'poe-appointments-aurora-security-group', {
            securityGroupName: `${ id }-aurora-security-group`,
            vpc: props.vpc,
            allowAllOutbound: false,
        });

        databaseSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(5432), 'Allows inbound Postgres');

        // Secret
        this._secret = new Secret(this, 'poe-appointments-aurora-db-secret', {
            secretName: `${ id }-aurora-db-secret`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    username: 'dbadmin',
                }),
                excludePunctuation: true,
                includeSpace: false,
                generateStringKey: 'password',
            },
        });

        this.credentials = Credentials.fromSecret(this._secret);

        // Engine
        const auroraEngine = DatabaseClusterEngine.auroraPostgres({
            version: auroraPostgresVersion,
        });

        this.rdsCluster = new DatabaseCluster(this, 'poe-appointments-aurora-cluster', {
            clusterIdentifier: `${ id }-aurora-cluster`,
            engine: auroraEngine,
            vpc: props.vpc,
            securityGroups: [databaseSecurityGroup],
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            defaultDatabaseName: props.databaseName,
            credentials: this.credentials,
            serverlessV2MinCapacity: 0.5,
            serverlessV2MaxCapacity: 32,
            writer: ClusterInstance.serverlessV2('writer'),
            readers: [ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true })],
            backup: {
                retention: cdk.Duration.days(14),
                preferredWindow: '17:00-18:00',
            },
            preferredMaintenanceWindow: 'Sat:18:15-Sat:19:15',
            port: NestedRdsStack.PORT, // 5432
            copyTagsToSnapshot: false,
            removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
            deletionProtection: false,
            storageEncrypted: true,
            // storageEncryptionKey: props.encryptionKey,
            storageType: DBClusterStorageType.AURORA,
        });

        props.internalSecurityGroup.connections.allowFrom(props.externalSecurityGroup, Port.tcp(NestedRdsStack.PORT));
        props.internalSecurityGroup.connections.allowTo(props.externalSecurityGroup, Port.tcp(NestedRdsStack.PORT));
        props.internalSecurityGroup.connections.allowFrom(Peer.ipv4('10.239.0.0/16'), Port.tcp(NestedRdsStack.PORT));

        // Tagging
        cdk.Tags.of(this.rdsCluster).add('env', id);
        cdk.Tags.of(this.rdsCluster).add('db-env', id);

        cdk.Tags.of(this.rdsCluster).add('Project', 'POE');

        new cdk.CfnOutput(this, `${ id }-cluster-readwrite-endpoint`, {
            value: this.rdsCluster.clusterEndpoint.hostname,
        });
        new cdk.CfnOutput(this, `${ id }-cluster-readonly-endpoint`, {
            value: this.rdsCluster.clusterReadEndpoint.hostname,
        });
        new cdk.CfnOutput(this, `${ id }-secret`, {
            value: this._secret.secretName,
        });

    }


    public getCredentials(): Credentials {
        return this.credentials;
    }

    public getSecrets(): ISecret {
        return this._secret;
    }

    public grantRead(role: iam.IRole): void {
        this._secret.grantRead(role);
    }

}