"use client";
import { useEffect } from "react";
import { useBetSlip } from "@/lib/betSlipStore";

export default function BetSlipInitializer() {
  useEffect(() => {
    void useBetSlip.getState().loadFromServer();
  }, []);

  return null;
}
