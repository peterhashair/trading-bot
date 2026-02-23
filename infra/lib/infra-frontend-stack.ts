import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { CachePolicy, Distribution, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { join } from 'path';

export class InfraFrontendStack extends Stack {

    constructor(scope: Construct, id: string, props?: any) {
        super(scope, id, props);

        const frontendBucket = new Bucket(this, `${ id }-bucket`, {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL
        })


        const cdn = new Distribution(this, `${ id }-cdn`, {
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(frontendBucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                { httpStatus: 404, responsePagePath: '/index.html' }
            ]
        })

        new BucketDeployment(this, `${ id }-deploy`, {
            sources: [Source.asset(join(__dirname, '../../frontend/dist'))],
            destinationBucket: frontendBucket,
            distribution: cdn,
            distributionPaths: ['/*'],
            prune: false
        })

        new CfnOutput(this, `${ id }-url`, { value: cdn.domainName })
    }
}