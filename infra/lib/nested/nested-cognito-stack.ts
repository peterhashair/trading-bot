import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CognitoUserPoolsAuthorizer } from "aws-cdk-lib/aws-apigateway";

export class NestedCognitoStack extends NestedStack {
    public userPool: UserPool;
    public authorizer: CognitoUserPoolsAuthorizer;
    public appClientId: string;
    public cognitoPolicy: PolicyStatement;

    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        this.userPool = new UserPool(this, `${ id }-cognito-user-pool`, {
            userPoolName: `${ id }-user-pool`,
            standardAttributes: {
                email: { required: true, mutable: true },
                phoneNumber: { required: false, mutable: true },
            },
            passwordPolicy: {
                requireDigits: true,
                requireUppercase: true,
                requireSymbols: true,
                requireLowercase: true,
                minLength: 8,
            },
            selfSignUpEnabled: true,
            signInAliases: { username: true, email: true },
        });

        const appClient = this.userPool.addClient(`${ id }-pool-client`, {
            userPoolClientName: `${ id }-pool-client`,
            accessTokenValidity: Duration.days(7),
            idTokenValidity: Duration.days(3),
            refreshTokenValidity: Duration.days(30),
            enableTokenRevocation: true,
        });

        this.appClientId = appClient.userPoolClientId;

        this.cognitoPolicy = new PolicyStatement({
            actions: [
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminDisableUser',
                'cognito-idp:AdminEnableUser',
            ],
            resources: [this.userPool.userPoolArn],
        });

        this.authorizer = new CognitoUserPoolsAuthorizer(this, `${ id }-cognito-authorizer`, {
            authorizerName: `${ id }-cognito-authorizer`,
            cognitoUserPools: [this.userPool],
            identitySource: 'method.request.header.Authorization',
        });
    }
}
