import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Browse } from './pages/Browse';
import { StartConversation } from './pages/StartConversation';
import { ConversationView } from './pages/ConversationView';
import { MyConversations } from './pages/MyConversations';
import { JoinConversation } from './pages/JoinConversation';
import { Connections } from './pages/Connections';
// Legacy routes
import { Stories } from './pages/Stories';
import { CreateStory } from './pages/CreateStory';
import { StoryReader } from './pages/StoryReader';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            {/* The Bench routes */}
            <Route path="browse" element={<Browse />} />
            <Route path="start" element={<StartConversation />} />
            <Route path="conversation/:id" element={<ConversationView />} />
            <Route path="my-conversations" element={<MyConversations />} />
            <Route path="join" element={<JoinConversation />} />
            <Route path="connections" element={<Connections />} />
            {/* Legacy routes */}
            <Route path="stories" element={<Stories />} />
            <Route path="create" element={<CreateStory />} />
            <Route path="story/:id" element={<StoryReader />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
