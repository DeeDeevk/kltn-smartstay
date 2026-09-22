import { useEffect, useState } from 'react';

// Theo dõi một media query (vd. '(min-width: 1024px)') và render lại khi kết quả đổi.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
