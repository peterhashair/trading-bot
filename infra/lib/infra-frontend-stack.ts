import { CfnOutput, NestedStack, NestedStackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { CachePolicy, Distribution, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

export class InfraFrontendStack extends NestedStack {
    public readonly domainName: string;
    public readonly bucketName: string;
    public readonly distributionId: string;

    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        const frontendBucket = new Bucket(this, `${id}-bucket`, {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        });

        const cdn = new Distribution(this, `${id}-cdn`, {
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(frontendBucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                { httpStatus: 404, responsePagePath: '/index.html' },
            ],
        });

        this.domainName = cdn.domainName;
        this.bucketName = frontendBucket.bucketName;
        this.distributionId = cdn.distributionId;
        new CfnOutput(this, `${id}-url`, { value: cdn.domainName });
    }
}
