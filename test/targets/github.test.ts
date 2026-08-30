import { createGitHubRelease } from '../../src/targets/github';

const originalFetch = global.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

function respondWith(status: number, body: unknown, statusText = '') {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

const baseOptions = {
  tag: 'v1.2.3',
  repository: 'cdklabs/publib',
  token: 'my-token',
};

test('creates a release', async () => {
  respondWith(201, { id: 1 });

  const result = await createGitHubRelease({
    ...baseOptions,
    body: '## Changelog',
    target: 'abcdef123',
  });

  expect(result).toBe('created');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, request] = mockFetch.mock.calls[0];
  expect(url).toBe('https://api.github.com/repos/cdklabs/publib/releases');
  expect(request.method).toBe('POST');
  expect(request.headers.Authorization).toBe('Bearer my-token');
  expect(JSON.parse(request.body)).toEqual({
    tag_name: 'v1.2.3',
    name: 'v1.2.3',
    body: '## Changelog',
    prerelease: false,
    target_commitish: 'abcdef123',
  });
});

test('marks the release as prerelease', async () => {
  respondWith(201, { id: 1 });

  await createGitHubRelease({ ...baseOptions, prerelease: true });

  const [, request] = mockFetch.mock.calls[0];
  expect(JSON.parse(request.body).prerelease).toBe(true);
});

test('omits target_commitish when no target is given', async () => {
  respondWith(201, { id: 1 });

  await createGitHubRelease(baseOptions);

  const [, request] = mockFetch.mock.calls[0];
  expect(JSON.parse(request.body)).not.toHaveProperty('target_commitish');
});

test('sends make_latest when latest is specified', async () => {
  respondWith(201, { id: 1 });

  await createGitHubRelease({ ...baseOptions, latest: false });

  const [, request] = mockFetch.mock.calls[0];
  expect(JSON.parse(request.body).make_latest).toBe('false');
});

test('omits make_latest when latest is not specified', async () => {
  respondWith(201, { id: 1 });

  await createGitHubRelease(baseOptions);

  const [, request] = mockFetch.mock.calls[0];
  expect(JSON.parse(request.body)).not.toHaveProperty('make_latest');
});

test('tolerates an already existing release', async () => {
  respondWith(422, {
    message: 'Validation Failed',
    errors: [{ resource: 'Release', code: 'already_exists', field: 'tag_name' }],
  });

  const result = await createGitHubRelease(baseOptions);

  expect(result).toBe('already_exists');
});

test('fails on other validation errors', async () => {
  respondWith(422, {
    message: 'Validation Failed',
    errors: [{ resource: 'Release', code: 'invalid', field: 'target_commitish' }],
  }, 'Unprocessable Entity');

  await expect(createGitHubRelease(baseOptions)).rejects.toThrow(/HTTP 422/);
});

test('fails on other errors with status and body in the message', async () => {
  respondWith(404, { message: 'Not Found' }, 'Not Found');

  await expect(createGitHubRelease(baseOptions)).rejects.toThrow(
    /HTTP 404 Not Found: .*Not Found/,
  );
});

test('fails on non-JSON error responses', async () => {
  respondWith(500, 'internal error', 'Internal Server Error');

  await expect(createGitHubRelease(baseOptions)).rejects.toThrow(/HTTP 500/);
});

test('uses a custom API URL for GitHub Enterprise', async () => {
  respondWith(201, { id: 1 });

  await createGitHubRelease({
    ...baseOptions,
    apiUrl: 'https://github.corporate-enterprise.com/api/v3/',
  });

  const [url] = mockFetch.mock.calls[0];
  expect(url).toBe('https://github.corporate-enterprise.com/api/v3/repos/cdklabs/publib/releases');
});
