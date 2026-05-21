"use client";

import { useUnifiedNavigation, UnifiedNavigateFunction } from "../system/platform";
import "./overlay.css";

function CustomOverlay() {
  const { navigate } = useUnifiedNavigation();

  return (
    <div className="overlay">

      Custom Overlay Content
      
    </div>
  )
}

export default CustomOverlay;