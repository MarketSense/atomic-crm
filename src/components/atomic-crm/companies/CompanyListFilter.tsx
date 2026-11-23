import { Building, Eye, Layers, Truck, Users } from "lucide-react";
import { FilterLiveForm, useGetIdentity, useTranslate } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { SearchInput } from "@/components/admin/search-input";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AccountManagerFilter } from "../sales/AccountManagerInput";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

// Trigger Desk watchlist filters. Atomic's own Size and Sector filters don't
// match the imported watchlist, which stores segment and status in its own columns.
const SEGMENTS = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "retirement_plan_provider", label: "Retirement plan provider" },
  {
    value: "industrial_agency_or_vendor",
    label: "Industrial agency or vendor",
  },
  { value: "other", label: "Other" },
];
const WATCH_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "excluded", label: "Excluded" },
];

export const CompanyListFilter = () => {
  const { identity } = useGetIdentity();
  const { companySectors } = useConfigurationContext();
  const translate = useTranslate();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <div className="w-52 min-w-52 flex flex-col gap-8">
      <FilterLiveForm>
        <SearchInput source="q" />
      </FilterLiveForm>

      <FilterCategory icon={<Layers className="h-4 w-4" />} label="Segment">
        {SEGMENTS.map((segment) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={segment.label}
            key={segment.value}
            value={{ segment: segment.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory icon={<Eye className="h-4 w-4" />} label="Watch status">
        {WATCH_STATUSES.map((status) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={status.label}
            key={status.value}
            value={{ watch_status: status.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Building className="h-4 w-4" />}
        label="resources.companies.fields.size"
      >
        {translatedSizes.map((size) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={size.name}
            key={size.name}
            value={{ size: size.id }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Truck className="h-4 w-4" />}
        label="resources.companies.fields.sector"
      >
        {companySectors.map((sector) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={sector.label}
            key={sector.value}
            value={{ sector: sector.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label="resources.companies.fields.sales_id"
      >
        <ToggleFilterButton
          className="w-full justify-between"
          label={translate("crm.common.me")}
          value={{ sales_id: identity?.id }}
        />
        <AccountManagerFilter className="w-full justify-between" />
      </FilterCategory>
    </div>
  );
};
