import axios from "@utils/axios";

export async function getSingleEntryRecords({
  report_type = "month",
  date,
  month,
  from_date,
  to_date,
  page = 1,
  per_page = 15,
  search = "",
  company_id = "",
  department_id = "",
  employee_category = "",
  holiday_worked = false,
} = {}) {
  const params = { report_type, page, per_page };

  if (report_type === "date" && date) {
    params.date = date;
  } else if (report_type === "range") {
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;
  } else if (month) {
    params.month = month;
  } else if (date) {
    params.date = date;
  }

  if (search) params.search = search;
  if (company_id) params.company_id = company_id;
  if (department_id) params.department_id = department_id;
  if (employee_category) params.employee_category = employee_category;
  if (holiday_worked) params.holiday_worked = 1;

  const res = await axios.get("/reports/time-cards/single-entry", { params });
  return res.data;
}
