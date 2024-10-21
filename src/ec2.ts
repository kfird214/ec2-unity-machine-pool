import { input } from './input';
import { EC2Client } from '@aws-sdk/client-ec2';

export const ec2 = new EC2Client({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});
