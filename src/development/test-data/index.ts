import type { TestDataContext, TestDataSeedResult } from './context';
import { seedSettings } from './settings';
import { seedRahcom } from './rahcom';

export const TEST_DATA_MODULES = ['rahcom', 'settings'] as const;
export type TestDataModuleKey = (typeof TEST_DATA_MODULES)[number];

export function isTestDataModuleKey(value: string): value is TestDataModuleKey {
  return (TEST_DATA_MODULES as readonly string[]).includes(value);
}

export function seedTestDataModule(key: TestDataModuleKey, context: TestDataContext): Promise<TestDataSeedResult> {
  switch (key) {
    case 'rahcom': return seedRahcom(context);
    case 'settings': return seedSettings(context);
  }
}



