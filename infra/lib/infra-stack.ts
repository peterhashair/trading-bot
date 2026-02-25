import { CfnOutput, CfnParameter, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { InfraFrontendStack } from "./infra-frontend-stack";
import { InfraBackendStack } from "./infra-backend-stack";
import { Profile } from "../bin/infra";

export interface InfraStackProps extends StackProps {
    profile: Profile;
}

export class InfraStack extends Stack {
    constructor(scope: Construct, id: string, props: InfraStackProps) {
        super(scope, id, props);

        const version = new CfnParameter(this, 'versionNumber', {
            type: 'String',
            default: 'latest',
        }).valueAsString;

        // Frontend stack is created first so its CloudFront domain can be used as the CORS origin in the backend
        const frontendStack = new InfraFrontendStack(this, 'InfraFrontendStack');

        const backendStack = new InfraBackendStack(this, 'InfraBackendStack', {
            profile: props.profile,
            version,
            corsOrigin: `https://${ frontendStack.domainName }`,
        });

        new CfnOutput(this, 'ApiGatewayUrl', {
            value: backendStack.apiUrl,
            description: 'API Gateway base URL — use as VITE_API_URL when building the frontend',
        });

        new CfnOutput(this, 'CognitoUserPoolId', {
            value: backendStack.userPoolId,
            description: 'Cognito User Pool ID',
        });

        new CfnOutput(this, 'CognitoClientId', {
            value: backendStack.appClientId,
            description: 'Cognito App Client ID',
        });

        new CfnOutput(this, 'FrontendUrl', {
            value: `https://${ frontendStack.domainName }`,
            description: 'CloudFront distribution URL',
        });
    }
}
