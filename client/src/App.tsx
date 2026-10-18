import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Intro from "./components/Intro";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import WorkPage from "./pages/WorkPage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactPage";
import ArcadePage from "./pages/ArcadePage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Intro />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="work" element={<WorkPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="arcade" element={<ArcadePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
