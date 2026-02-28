import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export function useTermSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    w: stdout?.columns ?? 120,
    h: stdout?.rows ?? 40,
  });

  useEffect(() => {
    const onResize = () => {
      if (stdout) setSize({ w: stdout.columns, h: stdout.rows });
    };
    stdout?.on('resize', onResize);
    return () => { stdout?.off('resize', onResize); };
  }, [stdout]);

  return size;
}
