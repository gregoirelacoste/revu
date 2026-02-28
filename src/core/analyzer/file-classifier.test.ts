import { describe, it, expect } from 'vitest';
import { classifyFile, isDisplayableFile, isTypeScriptFile } from './file-classifier.js';

describe('classifyFile', () => {
  it('classifies .controller.ts as controller', () => {
    expect(classifyFile('src/cases/case.controller.ts')).toBe('controller');
  });

  it('classifies .service.ts as service', () => {
    expect(classifyFile('src/auth/auth.service.ts')).toBe('service');
  });

  it('classifies .resolver.ts as service', () => {
    expect(classifyFile('src/graphql/case.resolver.ts')).toBe('service');
  });

  it('classifies .spec.ts as spec', () => {
    expect(classifyFile('src/auth/auth.service.spec.ts')).toBe('spec');
  });

  it('classifies files in /dto/ directory as dto', () => {
    expect(classifyFile('src/cases/dto/create-case.ts')).toBe('dto');
  });

  it('classifies plain .ts as unknown', () => {
    expect(classifyFile('src/utils/helpers.ts')).toBe('unknown');
  });

  it('classifies .json as unknown', () => {
    expect(classifyFile('package.json')).toBe('unknown');
  });
});

describe('isDisplayableFile', () => {
  it('returns false for spec', () => {
    expect(isDisplayableFile('spec')).toBe(false);
  });

  it('returns true for service', () => {
    expect(isDisplayableFile('service')).toBe(true);
  });
});

describe('isTypeScriptFile', () => {
  it('returns true for .ts', () => {
    expect(isTypeScriptFile('src/app.ts')).toBe(true);
  });

  it('returns false for .spec.ts', () => {
    expect(isTypeScriptFile('src/app.spec.ts')).toBe(false);
  });

  it('returns false for .js', () => {
    expect(isTypeScriptFile('src/app.js')).toBe(false);
  });
});
