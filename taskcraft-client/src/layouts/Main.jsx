import React from "react";
import NavBar from "../components/NavBar";
import { Outlet } from "react-router-dom";
import Footer from "../components/Footer";

const Main = () => {
  return (
    <div>
      {/* Navbar, */}
      <NavBar></NavBar>

      <div className="min-h-[calc(100vh-302px)]">
        <Outlet></Outlet>
      </div>

      {/* Outlet */}

      <Footer></Footer>

      {/* Footer */}
    </div>
  );
};

export default Main;
