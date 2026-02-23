import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { ISecurityGroup, IVpc, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';


export class NestedNetworkStack extends NestedStack {
    public external: ISecurityGroup;
    public internal: ISecurityGroup;
    public vpc: IVpc;

    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        this.vpc = new Vpc(this, `${ id }-vpc`, {
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'public',
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'private',
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],

        });
        this.external = new SecurityGroup(this, `${ id }-securityGroup-external`, {
            securityGroupName: `${ id }-securityGroup-external`,
            vpc: this.vpc,
            allowAllOutbound: true,
        });

        this.internal = new SecurityGroup(this, `${ id }-securityGroup-internal`, {
            securityGroupName: `${ id }-securityGroup-internal`,
            vpc: this.vpc,
            allowAllOutbound: false,
        });
    }
}
