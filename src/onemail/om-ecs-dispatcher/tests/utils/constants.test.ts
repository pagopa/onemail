import { APP_ENV_VALUES, versionRoutePath } from '#utils/constants';
import { describe, expect, it } from 'vitest';

describe('constants utils', () => {
  it('exposes the expected application environment values', () => {
    expect(APP_ENV_VALUES).toEqual({
      local: 'local',
      development: 'dev',
      uat: 'uat',
      production: 'prod',
    });
  });

  it('exposes the expected version route path', () => {
    expect(versionRoutePath).toEqual({
      v1: '/v1',
    });
  });
});
