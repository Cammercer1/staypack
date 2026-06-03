export type PropRadarSuburbResponse = {
  suburb: string;
  state: string;
  postcode: number;
  medians: {
    house_price?: number | null;
    unit_price?: number | null;
    house_weekly_rent?: number | null;
    unit_weekly_rent?: number | null;
  };
  yields: {
    house_gross_pct?: number | null;
    unit_gross_pct?: number | null;
  };
  market_dynamics: {
    vacancy_rate_pct?: number | null;
    house_days_on_market?: number | null;
    unit_days_on_market?: number | null;
    house_inventory_months?: number | null;
    unit_inventory_months?: number | null;
    house_heat_score?: number | null;
    unit_heat_score?: number | null;
  };
  demographics: {
    population?: number | null;
    median_age?: number | null;
    median_household_income?: number | null;
    owner_occupied_pct?: number | null;
    renter_pct?: number | null;
    unemployment_rate_pct?: number | null;
    socioeconomic_score?: number | null;
  };
  data_quality_flags?: string[];
  alternates?: unknown[];
  as_of?: string;
  currency?: string;
};
