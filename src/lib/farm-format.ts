export const money = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const milkTxt = (litres: number) =>
  `${litres.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
