import type { TestDataContext, TestDataCounts } from './context';
import { seedAccounting } from './accounting';
import { seedCommerce } from './commerce';
import { seedHumanResources } from './human-resources';
import { seedSettings } from './settings';
import { seedStatistics } from './statistics';
import { seedSupport } from './support';
import { seedRahcom } from './rahcom';

export const TEST_DATA_MODULES = [
  'accounting',
  'commerce',
  'human-resources',
  'statistics',
  'settings',
  'support',
  'rahcom',
] as const;

export type TestDataModuleKey = (typeof TEST_DATA_MODULES)[number];

export function isTestDataModuleKey(value: string): value is TestDataModuleKey {
  return (TEST_DATA_MODULES as readonly string[]).includes(value);
}

export async function seedTestDataModule(key: TestDataModuleKey, context: TestDataContext): Promise<TestDataCounts> {
  switch (key) {
    case 'accounting': return seedAccounting(context);
    case 'commerce': return seedCommerce(context);
    case 'human-resources': return seedHumanResources(context);
    case 'statistics': return seedStatistics(context);
    case 'settings': return seedSettings(context);
    case 'support': return seedSupport(context);
    case 'rahcom': return (await seedRahcom(context)).recordCounts;
  }
}
