import type { Config } from '@netlify/functions';
import { createArchiveHandler } from './lib/archiveApi';
export default createArchiveHandler('quiz');
export const config:Config={method:['GET','OPTIONS']};
