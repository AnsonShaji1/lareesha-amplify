import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../environments/amplify_outputs.json';

Amplify.configure(outputs as any);

export const client = generateClient({ authMode: 'userPool' }) as any;
