"use client"

import { UserDetailContext } from "@/context/UserDetailContext";
import axios from "axios";
import React, { useEffect, useState } from "react";

export default function Provider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [userDetail, setUserDetail] = useState<any>();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    async function loadAccount() {
      try {
        const response = await axios.get("/api/users");
        setUserDetail(response.data?.user);
        const subResponse = await axios.get("/api/subscriptions");
        setSubscriptions(subResponse.data?.subscriptions || []);
      } catch {
        // Signed-out visitors can still browse public pages.
      }
    }
    void loadAccount();
  }, []);

  return (
    <UserDetailContext.Provider value={{ userDetail, setUserDetail, subscriptions, setSubscriptions }}>
      <div>{children}</div>
    </UserDetailContext.Provider>
  );
}
