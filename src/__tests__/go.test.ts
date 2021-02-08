import { GoReleaser } from '../';

test('top-level', () => {

  process.env.GITHUB_TOKEN = 'token';

  const dir = `${__dirname}/__fixtures__/top-level`;
  const releaser = new GoReleaser(dir);

  jest.mock('../shell', () => ({
    gitClone: (_: string, __: string, ___: string) => {
      throw new Error('asdasd');
    },
  }));

  const release = releaser.release();

  expect(release.branch).toEqual('main');
  expect(release.tags).toEqual(['v1.20.1']);

});

test('sub-modules', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/sub-modules`);

  const release = releaser.release();

  expect(release.branch).toEqual('main');
  expect(release.tags).toEqual(['module1/v1.20.1', 'module2/v1.20.1']);

});

test('combined', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/combined`);

  const release = releaser.release();

  expect(release.branch).toEqual('main');
  expect(release.tags).toEqual(['v1.20.1', 'module1/v1.20.1', 'module2/v1.20.1']);

});

test('multi-version', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/multi-version`);

  const release = releaser.release();

  expect(release.branch).toEqual('main');
  expect(release.tags).toEqual(['module1/v1.20.1', 'module2/v1.20.2']);

});