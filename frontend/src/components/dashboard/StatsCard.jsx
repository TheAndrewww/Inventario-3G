import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatsCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
  subtitle,
  prefix = '',
  suffix = ''
}) => {
  const colorClasses = {
    blue: {
      bg: 'from-blue-500 to-blue-600',
      icon: 'text-blue-600',
      light: 'bg-blue-50'
    },
    green: {
      bg: 'from-green-500 to-green-600',
      icon: 'text-green-600',
      light: 'bg-green-50'
    },
    orange: {
      bg: 'from-orange-500 to-orange-600',
      icon: 'text-orange-600',
      light: 'bg-orange-50'
    },
    purple: {
      bg: 'from-purple-500 to-purple-600',
      icon: 'text-purple-600',
      light: 'bg-purple-50'
    },
    red: {
      bg: 'from-red-500 to-red-600',
      icon: 'text-red-600',
      light: 'bg-red-50'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="relative overflow-hidden bg-white rounded-2xl shadow-lg border border-gray-100 p-8 group"
    >
      {/* Gradiente de fondo decorativo */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.bg} opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline space-x-2">
              <h3 className="text-3xl font-bold text-gray-900">
                {prefix}{value}{suffix}
              </h3>
              {trend && (
                <span className={`flex items-center text-sm font-medium ${
                  trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {trendValue}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>

          {/* Icono */}
          <div className={`${colors.light} p-3 rounded-xl`}>
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          </div>
        </div>

        {/* Barra de progreso decorativa */}
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '75%' }}
            transition={{ duration: 1, delay: 0.2 }}
            className={`h-full bg-gradient-to-r ${colors.bg}`}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default StatsCard;
