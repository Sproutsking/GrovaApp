import React from "react";
import { Check, CheckCheck } from "lucide-react";

const MessageStatusIcon = ({ status, size = 14 }) => {
  if (status === "failed") {
    return <span aria-hidden="true">!</span>;
  }

  const Icon = status === "read" || status === "delivered" ? CheckCheck : Check;
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" focusable="false" />;
};

export default MessageStatusIcon;
