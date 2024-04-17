import * as git from '../../src/help/git';
import * as shell from '../../src/help/shell';

// mock shell.run
jest.mock('../../src/help/shell');
const mockedShellRun = (shell.run as unknown) as jest.Mock<typeof shell.run>;

// restore env after each test
const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules(); // Most important - it clears the cache
  process.env = { ...OLD_ENV }; // Make a copy
});

afterAll(() => {
  process.env = OLD_ENV; // Restore old environment
});

// test
test('clone with token', () => {
  process.env.GITHUB_TOKEN = 'my-token';

  git.clone('github.com/cdklabs/publib', 'target');

  expect(mockedShellRun.mock.calls).toHaveLength(1);
  expect(mockedShellRun.mock.calls[0]).toEqual(['git clone https://my-token@github.com/cdklabs/publib.git target']);
});

test('clone with ssh', () => {
  process.env.GITHUB_USE_SSH = '1';

  git.clone('github.com/cdklabs/publib', 'target');

  expect(mockedShellRun.mock.calls).toHaveLength(1);
  expect(mockedShellRun.mock.calls[0]).toEqual(['git clone git@github.com:cdklabs/publib.git target']);
});

test('throw exception without token or ssh', () => {
  const t = () => git.clone('github.com/cdklabs/publib', 'target');
  expect(t).toThrow('GITHUB_TOKEN env variable is required when GITHUB_USE_SSH env variable is not used');
});

test('throw exception without ghe authentication for github enterprise repo', () => {
  const t = () => git.clone('github.corporate-enterprise.com/cdklabs/publib', 'target');
  expect(t).toThrow('GITHUB_TOKEN env variable is required when GITHUB_USE_SSH env variable is not used');
});

test('throw exception with incomplete ghe authentication for github enterprise repo', () => {
  process.env.GITHUB_ENTERPRISE_TOKEN = 'valid-token';
  const t = () => git.clone('github.corporate-enterprise.com/cdklabs/publib', 'target');
  expect(t).toThrow('GITHUB_TOKEN env variable is required when GITHUB_USE_SSH env variable is not used');
});

test('clone with provided ghe authentication for github enterprise repo but no set github api url', () => {
  process.env.GH_ENTERPRISE_TOKEN = 'valid-token';
  process.env.GH_HOST = 'github.corporate-enterprise.com';
  const t = () => git.clone('github.corporate-enterprise.com/cdklabs/publib', 'target');
  expect(t).toThrow('GITHUB_TOKEN env variable is required when GITHUB_USE_SSH env variable is not used');
});

test('clone with provided ghe authentication for github enterprise repo and with non-public github api url', () => {
  process.env.GH_ENTERPRISE_TOKEN = 'valid-token';
  process.env.GH_HOST = 'github.corporate-enterprise.com';
  process.env.GITHUB_API_URL = 'https://api.github.corporate-enterprise.com';
  git.clone('github.corporate-enterprise.com/cdklabs/publib', 'target');
  expect(mockedShellRun.mock.calls).toHaveLength(1);
  expect(mockedShellRun.mock.calls[0]).toEqual(['git clone https://valid-token@github.corporate-enterprise.com/cdklabs/publib.git target']);
});
