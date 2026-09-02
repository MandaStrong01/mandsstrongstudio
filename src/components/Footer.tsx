interface FooterProps {
  showDoxyCredit?: boolean;
}

export default function Footer({ showDoxyCredit = false }: FooterProps) {
  return (
    <footer className="w-full py-6 px-4 text-center bg-purple-900/20 border-t border-purple-500/30">
      <p className="text-white/80 text-xs sm:text-sm break-words leading-relaxed">
        MandaStrong1 2025{showDoxyCredit && ' ~ Author Of Doxy The School Bully'} ~ Fundraiser:{' '}
        <span className="font-semibold">Educational Program on Bullying Prevention & Social Skills</span> ~{' '}
        All Etsy Store Proceeds Benefit Veterans Mental Health Services ~{' '}
        <a
          href="https://MandaStrong1.Etsy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-300 hover:text-purple-200 underline font-semibold transition-colors"
        >
          MandaStrong1.Etsy.com
        </a>
      </p>
    </footer>
  );
}
