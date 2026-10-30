import React, { useEffect, useState } from "react";
import Game from "./game/Game.jsx";
import AdminApp from "./admin/AdminApp.jsx";

// Rute sederhana berbasis hash:  #/  = game pegawai,  #/admin/...  = dashboard admin.
function useHash() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  if (hash.startsWith("#/admin")) {
    const tab = hash.replace(/^#\/admin\/?/, "").split("/")[0] || "dashboard";
    return <AdminApp tab={tab} />;
  }
  return <Game />;
}
