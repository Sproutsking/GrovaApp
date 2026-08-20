import React, { createContext, useContext, useState } from "react";
import {
  EXPERIENCE_CONFIG,
  getExperienceConfig,
  getStoredExperienceId,
} from "./experienceConfig";

const ExperienceContext = createContext(null);

export function ExperienceProvider({ children }) {
  const [experienceId, setExperienceId] = useState(getStoredExperienceId);

  const selectExperience = (nextId) => {
    if (!EXPERIENCE_CONFIG[nextId]) return;
    setExperienceId(nextId);
    window.localStorage.setItem("xeevia_active_experience", nextId);
  };

  return (
    <ExperienceContext.Provider
      value={{
        experienceId,
        experience: getExperienceConfig(experienceId),
        experiences: EXPERIENCE_CONFIG,
        selectExperience,
      }}
    >
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperience() {
  const context = useContext(ExperienceContext);
  if (!context) throw new Error("useExperience must be used inside ExperienceProvider");
  return context;
}
