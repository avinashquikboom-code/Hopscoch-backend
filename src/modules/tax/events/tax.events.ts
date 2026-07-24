import { EventEmitter } from 'events';
import logger from '../../../utils/logger';

export class TaxEventEmitter extends EventEmitter {}

export const taxEvents = new TaxEventEmitter();

taxEvents.on('tax_rule_created', (data) => {
  logger.info(`[TaxEvent] Tax Rule Created: ID=${data.id}, Code=${data.taxCode}, Rate=${data.rate}%`);
});

taxEvents.on('tax_rule_updated', (data) => {
  logger.info(`[TaxEvent] Tax Rule Updated: ID=${data.id}, Rate=${data.rate}%`);
});

taxEvents.on('tax_rule_deleted', (data) => {
  logger.info(`[TaxEvent] Tax Rule Deleted: ID=${data.id}`);
});
