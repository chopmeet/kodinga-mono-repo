import { cleanup, render, screen } from '@testing-library/react';

import { CodeBlock, codeLanguage } from './code-block';

afterEach(cleanup);

describe('codeLanguage', () => {
  it('reads the names of the post form and of the ``` fences', () => {
    expect(codeLanguage('typescript')).toBe('typescript');
    expect(codeLanguage('ts')).toBe('typescript');
    expect(codeLanguage('PY')).toBe('python');
    expect(codeLanguage('html')).toBe('xml');
    expect(codeLanguage('autre')).toBeNull();
    expect(codeLanguage(undefined)).toBeNull();
  });
});

describe('CodeBlock', () => {
  it('colors the code of its language, with a number per line and the indentation kept', () => {
    const code = 'function add(a: number) {\n  return a + 1;\n}\n';
    const { container } = render(<CodeBlock code={code} language="typescript" />);
    expect(screen.getByText('TypeScript')).toBeTruthy();
    expect(container.querySelector('.hljs-keyword')?.textContent).toBe('function');
    // 3 lines: the last line break does not count
    expect(container.querySelector('pre[aria-hidden]')?.textContent).toBe('1\n2\n3');
    expect(container.querySelector('code')?.textContent).toBe('function add(a: number) {\n  return a + 1;\n}');
  });

  it('shows html as text, never as markup', () => {
    const { container } = render(<CodeBlock code={'<script>alert(1)</script><img src=x onerror=alert(1)>'} language="html" />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('code img')).toBeNull();
    expect(container.querySelector('code')?.textContent).toBe('<script>alert(1)</script><img src=x onerror=alert(1)>');
  });

  it('keeps an unknown language as plain text, escaped too', () => {
    const { container } = render(<CodeBlock code={'<b>bold</b>'} language="autre" />);
    expect(screen.getByText('Code')).toBeTruthy();
    expect(container.querySelector('code b')).toBeNull();
    expect(container.querySelector('code')?.textContent).toBe('<b>bold</b>');
  });
});
