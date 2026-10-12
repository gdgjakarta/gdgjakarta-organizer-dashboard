"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReferralLeaderboardEntry } from "@/lib/firestore/types";

interface ReferralExportProps {
  entries: ReferralLeaderboardEntry[];
}

export function ReferralExport({ entries }: ReferralExportProps) {
  const escapeCsv = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCsv = () => {
    if (entries.length === 0) {
      toast.error("No referral leaderboard records to export.");
      return;
    }

    const headers = [
      "rank",
      "name",
      "email",
      "referral_code",
      "referral_points",
      "referrals_count",
      "prize_status",
      "joined_date",
    ];

    const rows = entries.map((e) => {
      const prizeStatus =
        e.rank === 1 && e.referral_points > 0
          ? "Eligible for Merch Prize (Rank #1 Leader)"
          : e.rank <= 3 && e.referral_points > 0
            ? "Top Contender"
            : "Participant";

      return [
        escapeCsv(e.rank),
        escapeCsv(e.name),
        escapeCsv(e.email),
        escapeCsv(e.referral_code),
        escapeCsv(e.referral_points),
        escapeCsv(e.referrals_count),
        escapeCsv(prizeStatus),
        escapeCsv(e.joined_date),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `gdg-jakarta-referral-leaderboard-${dateStr}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${entries.length} leaderboard entries to ${filename}`);
  };

  const handleExportJson = () => {
    if (entries.length === 0) {
      toast.error("No referral leaderboard records to export.");
      return;
    }

    const data = entries.map((e) => ({
      rank: e.rank,
      name: e.name,
      email: e.email,
      referral_code: e.referral_code,
      referral_points: e.referral_points,
      referrals_count: e.referrals_count,
      is_prize_winner: e.is_prize_winner,
      joined_date: e.joined_date,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `gdg-jakarta-referral-leaderboard-${dateStr}.json`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${entries.length} leaderboard entries to ${filename}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
          <Download className="size-3.5" />
          Export Leaderboard
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 text-xs">
        <DropdownMenuItem onClick={handleExportCsv} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="size-3.5 text-emerald-600" />
          Export as CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJson} className="gap-2 cursor-pointer">
          <Download className="size-3.5 text-primary" />
          Export as JSON (.json)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
