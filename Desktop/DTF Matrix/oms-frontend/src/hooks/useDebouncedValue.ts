import { useEffect, useState } from "react";

/**
 * Renvoie `value` après un délai stable de `delayMs` sans nouveau changement.
 * Utilisé par les barres de recherche pour ne déclencher la requête / le
 * filtrage qu'après une pause de frappe — évite un re-render à chaque touche
 * et garde l'UI fluide sur des listes denses.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
