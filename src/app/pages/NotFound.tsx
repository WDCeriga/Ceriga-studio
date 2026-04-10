import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Home } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-white px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-7xl font-bold text-gray-200 sm:text-9xl">404</h1>
        <h2 className="text-3xl font-bold mb-4">Page not found</h2>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="bg-[#534AB7] hover:bg-[#534AB7]/90">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
