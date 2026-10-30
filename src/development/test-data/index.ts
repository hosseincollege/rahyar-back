import type { TestDataContext, TestDataCounts } from './context';
import { seedSettings } from './settings';
import { seedRahcom } from './rahcom';

export const TEST_DATA_MODULES = ['settings', 'rahcom'] as const;

export type TestDataModuleKey = (typeof TEST_DATA_MODULES)[number];

export function isTestDataModuleKey(value: string): value is TestDataModuleKey {
  return (TEST_DATA_MODULES as readonly string[]).includes(value);
}

export async function seedTestDataModule(key: TestDataModuleKey, context: TestDataContext): Promise<TestDataCounts> {
  switch (key) {
    case 'settings': return seedSettings(context);
    case 'rahcom': return (await seedRahcom(context)).recordCounts;
  }
}
