import { defineFunction } from '@aws-amplify/backend';
import { Duration } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

export function definePythonFunction(
  metaUrl: string,
  logicalId: string,
  options?: { timeoutSeconds?: number; memorySize?: number; resourceGroupName?: string },
) {
  const functionDir = path.dirname(fileURLToPath(metaUrl));
  return defineFunction(
    (scope) =>
      new Function(scope, logicalId, {
        handler: 'index.handler',
        runtime: Runtime.PYTHON_3_12,
        timeout: Duration.seconds(options?.timeoutSeconds ?? 30),
        memorySize: options?.memorySize ?? 512,
        code: Code.fromAsset(functionDir),
      }),
    { resourceGroupName: options?.resourceGroupName ?? 'data' },
  );
}
