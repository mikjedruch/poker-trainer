import { useEffect, useState } from 'react';

// Hash routing ("#/math") works on GitHub Pages without server rewrites.

const currentPath = (): string => window.location.hash.replace(/^#/, '') || '/';

export function useHashPath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export const href = (path: string): string => `#${path}`;
