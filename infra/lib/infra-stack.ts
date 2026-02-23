import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { InfraFrontendStack } from "./infra-frontend-stack";
import { InfraBackendStack } from "./infra-backend-stack";


export class InfraStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const backendStack = new InfraBackendStack(this, 'InfraBackendStack');

        const frontendStack = new InfraFrontendStack(this, 'InfraFrontendStack');

    }
}
