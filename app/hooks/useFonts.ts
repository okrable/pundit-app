import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

export default function useFonts() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadFonts() {
      try {
        await Font.loadAsync({
          'Gotham-Black': require('../../assets/fonts/gotham-bundle/Gotham-Black.otf'),
          'Gotham-Bold': require('../../assets/fonts/gotham-bundle/Gotham-Bold.otf'),
          'Gotham-Medium': require('../../assets/fonts/gotham-bundle/Gotham-Medium.otf'),
          'Gotham-Book': require('../../assets/fonts/gotham-bundle/Gotham-Book.otf'),
          'Gotham-Light': require('../../assets/fonts/gotham-bundle/Gotham-Light.otf'),
          'UniSans-Heavy': require('../../assets/fonts/uni-sans/Uni Sans Heavy.otf'),
          'UniSans-Thin': require('../../assets/fonts/uni-sans/Uni Sans Thin.otf'),
        });
      } catch (error) {
        console.error('Error loading fonts:', error);
      } finally {
        if (isMounted) {
          setFontsLoaded(true);
        }
      }
    }

    void loadFonts();

    return () => {
      isMounted = false;
    };
  }, []);

  return fontsLoaded;
}
