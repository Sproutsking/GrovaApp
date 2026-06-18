import React from "react";
import useDomBackRegistry from "../hooks/useDomBackRegistry";

export default function DomBackRegistry({ children }) {
  useDomBackRegistry();
  return <>{children}</>;
}
