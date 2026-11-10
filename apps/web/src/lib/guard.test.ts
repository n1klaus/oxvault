import { describe, expect, it } from 'vite-plus/test';
import { assertSecureDeployment, describeOriginProblem } from './guard';

describe('deployment guard', () => {
  it('passes on https page', () => {
    const problem = describeOriginProblem('https://vault.example.com/oxvault/');
    expect(problem).toBeNull();
    expect(() => assertSecureDeployment('https://vault.example.com/oxvault/')).not.toThrow();
  });

  it('passes on http://localhost:8000', () => {
    const problem = describeOriginProblem('http://localhost:8000/oxvault/');
    expect(problem).toBeNull();
    expect(() => assertSecureDeployment('http://localhost:8000/oxvault/')).not.toThrow();

    const ipProblem = describeOriginProblem('http://127.0.0.1:8000/oxvault/');
    expect(ipProblem).toBeNull();
    expect(() => assertSecureDeployment('http://127.0.0.1:8000/oxvault/')).not.toThrow();
  });

  it('fails on http://vault.example.com and names both origins and /oxvault/ deploy path', () => {
    const targetUrl = 'http://vault.example.com/oxvault/';
    const problem = describeOriginProblem(targetUrl);

    expect(problem).not.toBeNull();
    expect(problem).toContain('HTTPS');
    expect(problem).toContain('localhost');
    expect(problem).toContain('/oxvault/');
    expect(problem).toContain('http://vault.example.com');
    expect(problem).toContain('https://vault.example.com');

    expect(() => assertSecureDeployment(targetUrl)).toThrowError(/HTTPS.*localhost.*\/oxvault\//);
  });

  it('fails on opaque origin null and names /oxvault/ deploy path', () => {
    const problem = describeOriginProblem('null');

    expect(problem).not.toBeNull();
    expect(problem).toContain('opaque origin');
    expect(problem).toContain('null');
    expect(problem).toContain('HTTPS');
    expect(problem).toContain('localhost');
    expect(problem).toContain('/oxvault/');

    expect(() => assertSecureDeployment('null')).toThrowError(/opaque origin.*\/oxvault\//);
  });

  it('fails on file: origin and names /oxvault/ deploy path', () => {
    const problem = describeOriginProblem('file:///home/user/oxvault/index.html');

    expect(problem).not.toBeNull();
    expect(problem).toContain('opaque origin');
    expect(problem).toContain('/oxvault/');

    expect(() => assertSecureDeployment('file:///home/user/oxvault/index.html')).toThrowError(
      /opaque origin.*\/oxvault\//,
    );
  });
});
