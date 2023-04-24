import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

test('this runs with AWS credentials', async () => {
  const sts = new STSClient({});
  const response = await sts.send(new GetCallerIdentityCommand({}));
  expect(response.Arn).toBeTruthy();
});