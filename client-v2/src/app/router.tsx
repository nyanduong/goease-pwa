import { createBrowserRouter } from 'react-router';
import { travelerSections } from '../config/traveler-sections';
import { TravelerLayout } from '../layouts/traveler-layout';
import { FoundationPage } from '../pages/foundation-page';
import {
  NotFoundPage,
  RouteErrorPage,
  SectionPage,
} from '../pages/status-pages';

export const router = createBrowserRouter([
  {
    element: <TravelerLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { id: '/', index: true, element: <FoundationPage /> },
      ...travelerSections.slice(1).map(({ path, label }) => ({
        id: path,
        path,
        element: <SectionPage title={label} />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
