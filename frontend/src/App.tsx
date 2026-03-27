import { AuthProvider } from "./auth/AuthContext";
import OpenRAGApp from "./openrag-ui/OpenRAGApp";
import { ThemeProvider } from "./theme/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OpenRAGApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
