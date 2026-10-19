import { render, screen } from '@testing-library/react';

import { htmlToText, Markdown } from './markdown';

describe('Markdown', () => {
  it('renders headings, lists, code and inline marks as elements', () => {
    const { container } = render(
      <Markdown
        source={[
          '# Les hooks',
          'Un hook **commence** par `use` et se lit *simplement*.',
          '',
          '- useState',
          '- useEffect',
          '',
          '```ts',
          'const [n, setN] = useState(0);',
          '```',
          '> À retenir',
        ].join('\n')}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Les hooks' })).toBeTruthy();
    expect(screen.getByText('commence').tagName).toBe('STRONG');
    expect(screen.getByText('use').tagName).toBe('CODE');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['useState', 'useEffect']);
    expect(container.querySelector('pre code')?.textContent).toBe('const [n, setN] = useState(0);');
    expect(container.querySelector('blockquote')?.textContent).toBe('À retenir');
  });

  it('never runs a script nor follows a dangerous link', () => {
    const { container } = render(<Markdown source={'<img src=x onerror="alert(1)"> [clic](javascript:alert(1)) [doc](https://react.dev)'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link', { name: 'clic' })).toBeNull();
    expect(screen.getByRole('link', { name: 'doc' }).getAttribute('href')).toBe('https://react.dev');
  });

  it('reads the text of an HTML lesson without executing it', () => {
    expect(htmlToText('<p>Bonjour</p><script>alert(1)</script><p><b>Dakar</b></p>')).toBe('Bonjour\nDakar');
  });
});
