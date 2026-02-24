#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from "../lib/infra-stack";

export enum Profile {
    staging = 'staging',
    Prod = 'prod'
}

const app = new cdk.App();
const profile = (app.node.tryGetContext('profile') as Profile) ?? Profile.staging;

new InfraStack(app, 'InfraStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    profile,
});
